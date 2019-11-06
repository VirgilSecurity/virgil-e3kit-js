import { ICard, FindUsersResult } from '../types';
import { isVirgilCard, isFindUsersResult } from '../typeguards';
import { getObjectValues } from '../array';
import { isValidDate } from './date';

/**
 * @hidden
 */
export function getCardActiveAtMoment(card: ICard, activeAt?: Date | number) {
    if (!activeAt) {
        return card;
    }

    const activeAtDate = new Date(activeAt);
    if (!isValidDate(activeAtDate)) {
        throw new TypeError(
            'Cannot get active card. Second argument, if provided, must be a Date or a timestamp',
        );
    }

    let actualCard: ICard | undefined = card;
    while (actualCard && actualCard.createdAt > activeAt) {
        actualCard = actualCard.previousCard;
    }

    if (!actualCard) {
        throw new Error(
            'The given sender Virgil Card is newer than the encrypted data.' +
                'This may happen if they un-registered and registered again with the same identity.' +
                'Try loading their Virgil Card by its ID.',
        );
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
