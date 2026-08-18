import type { User } from '../../infrastructure/database/generated/client';
import {
  CURRENT_USER_REQUIRED_KEY,
  CurrentUser,
} from './current-user.decorator';

describe('CurrentUser', () => {
  it('marks the route for an opt-in database lookup', () => {
    class TestController {
      handler(@CurrentUser() user: User): User {
        return user;
      }
    }

    expect(
      Reflect.getMetadata(
        CURRENT_USER_REQUIRED_KEY,
        TestController.prototype.handler,
      ),
    ).toBe(true);
  });
});
