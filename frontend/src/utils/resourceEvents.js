/**
 * Server-sent resource events.
 *
 * Every FHIR write — from any session, through the proxy or a backend
 * service — is broadcast over the WebSocket and arrives as one of these
 * three events with `{ patientId, resourceType, resourceId, resource }`.
 * A delete carries a stub resource (`{ resourceType, id }`).
 */
import { CLINICAL_EVENTS } from '../constants/clinicalEvents';

export const RESOURCE_EVENTS = [
  CLINICAL_EVENTS.RESOURCE_CREATED,
  CLINICAL_EVENTS.RESOURCE_UPDATED,
  CLINICAL_EVENTS.RESOURCE_DELETED
];

export const isResourceEvent = (eventType) => RESOURCE_EVENTS.includes(eventType);

/**
 * Whether a view showing `resourceTypes` for `patientId` should react to an
 * event. Domain events (order.placed, ...) carry no resource type and always
 * pass the type check; resource events must name one of the view's types.
 */
export const isRelevantEvent = (eventType, event, patientId, resourceTypes) => {
  if (!event || event.patientId !== patientId) return false;
  if (!isResourceEvent(eventType)) return true;
  return resourceTypes.includes(event.resourceType);
};

/** Insert, replace or remove one resource in a list, by id. */
export const applyResourceEvent = (list, eventType, resource, transform = (r) => r) => {
  const items = list || [];
  if (!resource?.id) return items;
  if (eventType === CLINICAL_EVENTS.RESOURCE_DELETED) {
    return items.some(item => item.id === resource.id)
      ? items.filter(item => item.id !== resource.id)
      : items;
  }
  const next = transform(resource);
  return items.some(item => item.id === resource.id)
    ? items.map(item => (item.id === resource.id ? next : item))
    : [next, ...items];
};
