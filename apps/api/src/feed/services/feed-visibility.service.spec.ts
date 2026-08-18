import { FeedVisibilityService } from './feed-visibility.service';

describe('FeedVisibilityService (Unit)', () => {
  let service: FeedVisibilityService;

  beforeEach(() => {
    service = new FeedVisibilityService();
  });

  it('should instantiate FeedVisibilityService cleanly', () => {
    expect(service).toBeDefined();
  });
});
