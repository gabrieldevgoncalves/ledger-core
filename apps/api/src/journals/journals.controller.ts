import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { JournalsService } from './journals.service';
import { PostJournalDto } from './dto/post-journal.dto';
import { ListJournalsDto } from './dto/list-journals.dto';
import { ReverseJournalDto } from './dto/reverse-journal.dto';

@Controller('journals')
export class JournalsController {
  constructor(private readonly service: JournalsService) {}

  @Post()
  async post(
    @Body() dto: PostJournalDto,
    @Res({ passthrough: true }) reply: any,
  ) {
    const result = await this.service.post(dto);
    reply.code(result.created ? 201 : 200);
    return result.journal;
  }

  @Get()
  findAll(@Query() dto: ListJournalsDto) {
    return this.service.findAll(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post(':id/reverse')
  @HttpCode(201)
  reverse(@Param('id') id: string, @Body() dto: ReverseJournalDto) {
    return this.service.reverse(id, dto.description);
  }
}
