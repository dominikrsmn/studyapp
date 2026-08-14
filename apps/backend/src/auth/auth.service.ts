import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // sign in / sign up, etc. using magic links and mail.
  async signInWithMagicLink(email: string): Promise<void> {
    // Check if the user exists
    const user = await this.usersService.findOne(email);

    if (!user) {
      // If the user doesn't exist, create a new user
      // You can implement the logic to create a new user here
      // For example:
      // await this.usersService.createUser(email);
    }

    // Generate a magic link and send it to the user's email
    // You can implement the logic to generate and send the magic link here
  }

  async verifyMagicLink(token: string) {
    // Verify the magic link token and authenticate the user
    const payload = {
      sub: 'userId',
      email: 'email',
    };
    return this.jwtService.verifyAsync(token);
  }
}
