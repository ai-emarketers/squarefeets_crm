// Request bodies for the Export approval endpoints.
import { IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateExportRequestDto {
  @IsOptional() @IsString() id?: string;
  @IsIn(['properties', 'leads', 'prospects'], { message: 'Unknown export type.' }) kind: string;
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(0) rowCount?: number;
}

export class DecisionDto {
  @IsIn(['Approved', 'Rejected'], { message: 'Decision must be Approved or Rejected.' }) status: 'Approved' | 'Rejected';
}
