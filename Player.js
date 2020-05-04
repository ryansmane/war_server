class Player {
   constructor(id) {
      this.id = id;
      this.deck = [];
      this.ready = false;
      this.initialized = false;
      this.enabled = true;
   }

   removeTopCards() {
      let max = Math.min(3, this.deck.length);
      let tops = [];
      for (let i = 0; i < max; i++) {
         tops.push(this.deck.pop());
      }
      return tops;
   }

   getTopCard() {
      return this.deck.length > 0 ? this.deck.pop() : null;
   }

   addWinnings(winnings) {
      this.deck = winnings.concat(this.deck);
   }

   getDeckLength() {
      return this.deck.length;
   }
}

exports.Player = Player;
