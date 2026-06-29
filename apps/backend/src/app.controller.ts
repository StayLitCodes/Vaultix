import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
@ApiTags('root')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get the backend service welcome message' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Welcome message retrieved successfully' })
  getHello(): string {
    return this.appService.getHello();
  }
}
