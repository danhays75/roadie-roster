import Common "common";

module {
  /// One of the six Gift Bag shopping-list categories.
  public type GiftBagCategory = {
    #candySnack;
    #drink;
    #sportsTeam;
    #color;
    #shirtSize;
    #hatSize;
  };

  /// One grouped answer and how many active roadies gave it. `answer` is the
  /// most common spelling of the group; grouping is case-insensitive and
  /// ignores extra spaces and punctuation.
  public type GiftBagAnswerCount = {
    answer : Text;
    count : Nat;
  };

  /// The shopping list for one category: answers sorted by count (highest
  /// first), plus how many active roadies left the category unanswered.
  public type GiftBagGroup = {
    category : GiftBagCategory;
    answers : [GiftBagAnswerCount];
    noAnswer : Nat;
  };

  /// One printable bag label. Carries only non-contact fields: name, position,
  /// house and the six Gift Bag answers. Never phone, email or date of birth.
  public type GiftBagLabel = {
    roadieId : Common.RoadieId;
    name : Text;
    positionName : Text;
    house : Common.House;
    candySnack : ?Text;
    drink : ?Text;
    sportsTeam : ?Text;
    color : ?Text;
    shirtSize : ?Text;
    hatSize : ?Text;
  };

  /// The Gift Bags payload: the shopping list and the printable labels for the
  /// selected filter, across active (non-archived) roadies only.
  public type GiftBagsData = {
    groups : [GiftBagGroup];
    labels : [GiftBagLabel];
  };

  /// The Gift Bags filter: all active roadies, roadies only, leaders only, one
  /// house, or one position. `#leaders` selects the manager, trainer and
  /// leadership roles; a leader's label shows their title instead of a position.
  public type GiftBagFilter = {
    #all;
    #roadies;
    #leaders;
    #foh;
    #boh;
    #position : Common.PositionId;
  };
};
