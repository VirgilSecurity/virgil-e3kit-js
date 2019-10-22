import { ICard, FindUsersResult } from '../types';
import { isVirgilCard, isFindUsersResult } from '../typeguards';
import { getObjectValues } from '../array';

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

/**
 * @hidden
 */
export const getCardsArray = (cardOrFindUsersResult: ICard | FindUsersResult) => {
    if (isVirgilCard(cardOrFindUsersResult)) {
        return [cardOrFindUsersResult];
    }
    if (isFindUsersResult(cardOrFindUsersResult)) {
        return getObjectValues(cardOrFindUsersResult);
    }
    return [];
};
