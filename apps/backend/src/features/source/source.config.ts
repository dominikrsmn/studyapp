import { registerAs } from '@nestjs/config';

export const sourceConfig = registerAs('source', () => ({
  stateChangedEventName: 'source.stateChanged',
  acceptedFileType: 'application/pdf',
}));
