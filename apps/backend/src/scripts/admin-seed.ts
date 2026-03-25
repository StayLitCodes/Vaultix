import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { User, UserRole } from '../modules/user/entities/user.entity';
import { getRepository } from 'typeorm';

async function seedAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepository = getRepository(User);

    // Check if admin already exists
    const existingAdmin = await userRepository.findOne({
      where: { walletAddress: 'ADMIN_WALLET_ADDRESS' },
    });

    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Create super admin
    const superAdmin = userRepository.create({
      walletAddress: 'ADMIN_WALLET_ADDRESS',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    });

    await userRepository.save(superAdmin);

    // Create regular admin
    const admin = userRepository.create({
      walletAddress: 'REGULAR_ADMIN_WALLET_ADDRESS',
      role: UserRole.ADMIN,
      isActive: true,
    });

    await userRepository.save(admin);

    console.log('Admin users created successfully');
    console.log('Super Admin:', superAdmin.walletAddress);
    console.log('Admin:', admin.walletAddress);
  } catch (error) {
    console.error('Error seeding admin users:', error);
  } finally {
    await app.close();
  }
}

void seedAdmin();
