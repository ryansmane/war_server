
const SUITS = ['C', 'H', 'D', 'S'];
const PIPS = [2, 2, 2, 2, 2, 2, 2, 2, 2, 11, 12, 13, 14];

class Deck {
    constructor() {
        let d = [];
        for (let i = 0; i < PIPS.length; i++) {
           for (let k = 0; k < SUITS.length; k++) {
              d.push(new Card(SUITS[k], PIPS[i]));
           }
        }
        this.deck = d;
    }

    shuffle() {
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