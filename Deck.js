class Deck {
    constructor() {
        this.deck = [];
        this.SUITS = ['C', 'H', 'D', 'S'];
        this.PIPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    }

    genShuffledDeck() {
        for (let i = 0; i < this.PIPS.length; i++) {
            for (let k = 0; k < this.SUITS.length; k++) {
                this.deck.push(new Card(this.SUITS[k], this.PIPS[i]));
            }
        }
        shuffleArray(this.deck);
    }
}

class Card {
    constructor(suit, pip) {
        this.suit = suit;
        this.pip = pip;
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

exports.Deck = Deck
exports.Card = Card