/**
 * A chart opened while the socket is still connecting (or mid-reconnect)
 * used to get no live updates at all: subscribeToPatient returned nothing
 * unless the socket was already open, and nothing retried.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../config/apiConfig', () => ({ getWebSocketUrl: () => 'ws://test/api/ws' }));

import websocketService from '../websocket';

const sentBy = (ws) => ws.send.mock.calls.map(([raw]) => JSON.parse(raw));

describe('websocket subscriptions', () => {
  let ws;

  beforeEach(() => {
    ws = { send: vi.fn(), readyState: 1, close: vi.fn() };
    websocketService.ws = ws;
    websocketService.isConnected = false;
    websocketService.activeSubscriptions = new Map();
    websocketService.messageQueue = [];
  });

  it('records a subscription made before the socket is open and sends it on connect', async () => {
    const id = await websocketService.subscribeToPatient('p1', ['Condition']);

    expect(id).toBeTruthy();
    expect(ws.send).not.toHaveBeenCalled();

    websocketService.isConnected = true;
    websocketService.resubscribeAll();

    expect(sentBy(ws)).toEqual([
      { type: 'subscribe', data: { subscription_id: id, patient_ids: ['p1'], resource_types: ['Condition'] } }
    ]);
  });

  it('sends immediately when already connected, exactly once', async () => {
    websocketService.isConnected = true;
    const id = await websocketService.subscribeToPatient('p1', []);

    expect(sentBy(ws).map(m => m.data.subscription_id)).toEqual([id]);
  });

  it('gives two views subscribing in the same instant different ids', async () => {
    const a = await websocketService.subscribeToPatient('p1', []);
    const b = await websocketService.subscribeToPatient('p1', []);

    expect(a).not.toEqual(b);
    expect(websocketService.activeSubscriptions.size).toBe(2);
  });

  it('forgets a subscription dropped while disconnected, so reconnect does not revive it', async () => {
    const id = await websocketService.subscribeToPatient('p1', []);
    await websocketService.unsubscribeFromPatient(id);

    websocketService.isConnected = true;
    websocketService.resubscribeAll();

    expect(ws.send).not.toHaveBeenCalled();
  });

  it('does the same for rooms', async () => {
    const id = await websocketService.subscribeToRoom('pharmacy:queue');
    expect(id).toBeTruthy();

    websocketService.isConnected = true;
    websocketService.resubscribeAll();

    expect(sentBy(ws)).toEqual([{ type: 'subscribe', data: { subscription_id: id, room: 'pharmacy:queue' } }]);
  });

  it('turns a server delete into a resource.deleted event carrying patient and stub', () => {
    const seen = [];
    const off = websocketService.subscribe('resource.deleted', (e) => seen.push(e));

    websocketService.handleMessage({
      type: 'update',
      data: { action: 'deleted', resource_type: 'Condition', resource_id: 'c1', patient_id: 'p1', resource: { resourceType: 'Condition', id: 'c1' } }
    });
    off();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ patientId: 'p1', resourceType: 'Condition', resource: { resourceType: 'Condition', id: 'c1' }, fromWebSocket: true });
  });
});
