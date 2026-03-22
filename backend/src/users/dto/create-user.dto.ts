import { InviteEmployeeDto } from '../../auth/dto/invite-employee.dto';

/** Aligné sur POST /auth/invite — même corps que l’invitation RH. */
export class CreateUserDto extends InviteEmployeeDto {}
