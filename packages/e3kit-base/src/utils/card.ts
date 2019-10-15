import { ICard } from '../types';

/**
 * @hidden
 */
export function getCardActiveAtMoment(card: ICard, activeOn: Date) {
    let actualCard: ICard | undefined = card;
    while (actualCard && actualCard.createdAt > activeOn) {
        actualCard = actualCard.previousCard;
    }

    return actualCard;
}
