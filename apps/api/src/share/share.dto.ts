// Request body for POST /api/share/matches (send matched properties as a PDF, with their documents, by email or WhatsApp).
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Property details, the client's email and the document files are all read from the database on the server;
// the browser only sends ids, so it cannot make the API send arbitrary content or files to an arbitrary address.
export class ShareMatchesDto {
  @IsIn(['email', 'whatsapp']) channel: 'email' | 'whatsapp';
  @IsOptional() @IsString() @MaxLength(60) prospectId?: string;            // the client (a prospect), or ...
  @IsOptional() @IsString() @MaxLength(60) leadId?: string;                // ... a lead (WhatsApp only: leads have no email)
  @IsOptional() @IsString() @MaxLength(60) requirementId?: string;         // the requirement the properties were matched to (for match % and reasons)
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) propertyIds: string[]; // 1 to 10 properties
  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) documentIds?: string[];    // only these documents; left out = every shareable document
  @IsOptional() @IsString() @MaxLength(400) note?: string;                // short message from the realtor
  @IsOptional() @IsString() @MaxLength(150) subject?: string;             // email subject
  @IsOptional() @IsString() @MaxLength(200) origin?: string;              // address of the website, used to build download links (PUBLIC_WEB_URL wins)
}
