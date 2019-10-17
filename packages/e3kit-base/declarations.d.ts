declare module 'subleveldown' {
    import { LevelUp } from 'levelup';
    import { AbstractOptions } from 'abstract-leveldown';

    export default function(db: LevelUp, name: string, options?: AbstractOptions): LevelUp;
}
