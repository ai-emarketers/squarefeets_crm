// Request bodies for the Team REST endpoints (validated automatically by the global ValidationPipe).
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TeamMemberDto {
  @IsString() @MinLength(1, { message: 'Name is required.' }) @MaxLength(80) name: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() corp?: string;
  @IsOptional() @IsString() alt?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() seeNumbers?: boolean;
}

export class MemberUpdateDto {
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() corp?: string;
  @IsOptional() @IsString() alt?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() seeNumbers?: boolean;
}

export class StatusDto {
  @IsIn(['Active', 'Disabled'], { message: 'Status must be Active or Disabled.' }) status: 'Active' | 'Disabled';
}

export class SetPasswordDto {
  @IsString() @MinLength(8, { message: 'Password must be at least 8 characters.' }) password: string;
  @IsOptional() @IsString() email?: string;
}
