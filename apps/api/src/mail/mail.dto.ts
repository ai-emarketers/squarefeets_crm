// Request body for POST /api/mail/matches (send matched properties to a client by email).
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

// What the broker picked in the "Send to client" dialog. Property details and the client's email are read from the
// database on the server, so the browser cannot make the API send arbitrary content to an arbitrary address.
export class SendMatchesMailDto {
  @IsString() @MaxLength(60) prospectId: string;                       // the client (a prospect) to email
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) propertyIds: string[]; // 1 to 10 properties
  @IsOptional() @IsString() @MaxLength(150) subject?: string;          // subject line (a default is used when empty)
  @IsOptional() @IsString() @MaxLength(1000) intro?: string;           // opening paragraph (a default is used when empty)
  @IsOptional() @IsString() @MaxLength(200) reqSummary?: string;       // e.g. "3 BHK, Salt Lake, ₹1.2–1.5 Cr"
  @IsOptional() @IsObject() scores?: Record<string, number>;           // match % per property id (display only)
}
