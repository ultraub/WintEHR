/**
 * The built-in viewer asks the metadata route for image instances only, so
 * SR and SEG objects stored in the same study are not drawn as slices.
 */

import React from 'react';
import { render, waitFor } from '../../../../test-utils/test-utils';
import DICOMViewer from '../DICOMViewer';
import { apiClient } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  __esModule: true,
  apiClient: { get: vi.fn() },
}));

test('the study metadata request asks for image instances only', async () => {
  apiClient.get.mockImplementation(() =>
    Promise.reject({ response: { status: 503, data: { detail: 'down' } }, message: 'HTTP 503' })
  );

  render(<DICOMViewer study={{ id: 'study-1', studyDirectory: '1.2.3.4' }} onClose={() => {}} />);

  await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
  const metadataCalls = apiClient.get.mock.calls.filter(([url]) => url.endsWith('/metadata'));
  expect(metadataCalls.length).toBeGreaterThan(0);
  const [url, config] = metadataCalls[0];
  expect(url).toBe('/api/dicom/studies/1.2.3.4/metadata');
  expect(config.params).toEqual({ images_only: true });
});
