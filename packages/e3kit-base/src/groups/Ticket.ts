import { IGroupSessionMessageInfo } from '../types';

export class Ticket {
    constructor(
        public groupSessionMessage: IGroupSessionMessageInfo,
        public participants: string[],
    ) {}
}
