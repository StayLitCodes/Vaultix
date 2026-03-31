import { Test } from '@nestjs/testing';
import { AdminModule } from '../src/modules/admin/admin.module';

async function bootstrap() {
  try {
    const moduleFixture = await Test.createTestingModule({
      imports: [AdminModule],
    }).compile();
    console.log('AdminModule compiled successfully');
    await moduleFixture.close();
  } catch (error) {
    console.error('Failed to compile AdminModule:', error);
    process.exit(1);
  }
}

void bootstrap();
