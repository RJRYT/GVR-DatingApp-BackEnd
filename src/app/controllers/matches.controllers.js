const { User, Preference, MatchPoints } = require("../models");
const CatchAsync = require("../util/catchAsync");
const { sortAndRankMatches } = require("../util/MatchUtil");

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from matches" });
};

exports.matchAlgorithm = CatchAsync(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query;

  const user = await User.findById(userId);
  const preferences = await Preference.findOne({ userId });
  if (!preferences) {
    return res.json({ status: 400, success: false, message: "No matching preferences found" });
  }
  if (Object.keys(preferences) < 3) {
    return res.json({ status: 400, success: false, message: "Update your preferences" });
  }

  const matchPoints = await MatchPoints.findOne({});

  let matchingQuery = {
    _id: { $ne: userId, $nin: [...user.rejected] },
    age: {
      $gte: preferences.AgeRange.min,
      $lte: preferences.AgeRange.max,
    },
    ["location.shortName"]: { $in: preferences.Location.map(loc => loc.value) },
    personalInfoSubmitted: true,
    professionalInfoSubmitted: true,
    purposeSubmitted: true,
    rejected: { $nin: [userId] }
  };
  if (preferences.Interests.length) {
    matchingQuery["interests.value"] = { $in: preferences.Interests.map(intst => intst.value) };
  }
  if (preferences.Hobbies.length) {
    matchingQuery["hobbies.value"] = { $in: preferences.Hobbies.map(hby => hby.value) };
  }
  if (preferences.Education.length) {
    matchingQuery["qualification.value"] = { $in: preferences.Education.map(edu => edu.value) }; 
  }
  if (preferences.Gender) {
    if(preferences.Gender.value !== "both") matchingQuery.gender = preferences.Gender.value;
  }

  // Find users that match the preferences
  let matches = await User.find(
    matchingQuery,
    "id username age gender location hobbies interests smokingHabits drinkingHabits qualification profilePic images shortReel isOnline"
  )
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean()
    .exec();

  // Get total matching users count
  const count = await User.countDocuments(matchingQuery);

  matches = await sortAndRankMatches(matches, preferences, matchPoints, user.location);

  res.json({
    status: 200,
    success: true,
    message: "Matches found",
    matches,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
});

exports.modifyPreferences = CatchAsync(async (req, res) => {
  const userId = req.user.id;
  const {
    AgeRange,
    HeightRange,
    WeightRange,
    Location,
    Interests,
    Hobbies,
    Education,
    Gender,
    Religion,
    Occupation,
    LifeStyle,
    Relation,
  } = req.body;

  // Validation for AgeRange and Location
  // if (!AgeRange || !AgeRange.min || !AgeRange.max || !Location.length) {
  //   return res.json({ status: 400, success: false, message: "AgeRange and Location are required." });
  // }

  // Find existing preferences
  let preferences = await Preference.findOne({ userId });

  if (preferences) {
    // Update existing preferences
    preferences.AgeRange = AgeRange;
    preferences.HeightRange = HeightRange;
    preferences.WeightRange = WeightRange;
    preferences.Location = Location;
    preferences.Interests = Interests;
    preferences.Hobbies = Hobbies;
    preferences.Education = Education;
    preferences.Gender = Gender;
    preferences.Religion = Religion;
    preferences.Relation = Relation;
    preferences.Occupation = Occupation;
    preferences.LifeStyle = LifeStyle;

    await preferences.save();
  } else {
    // Create new preferences
    preferences = new Preference({
      userId,
      AgeRange,
      HeightRange,
      WeightRange,
      Location,
      Interests,
      Hobbies,
      Education,
      Gender,
      Religion,
      Relation,
      Occupation,
      LifeStyle
    });

    await preferences.save();
  }

  res.json({ status: 200, success: true, message: "Preferences saved successfully.", preferences });
});

exports.viewPreferences = CatchAsync(async (req, res) => {
  const userId = req.user.id;

  // Get the user's matching preferences
  const preferences = await Preference.findOne({ userId });
  if (!preferences) {
    return res.json({ status: 400, success: false, message: "No matching preferences found." });
  }

  res.json({ status: 200, success: true, preferences });
});

exports.fetchFilteredMatches = CatchAsync(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, filter = "" } = req.query;

  const user = await User.findById(userId);
  let matchPoints = await MatchPoints.findOne({});

  if (!matchPoints) {
    // Generate random match points and save them if not found
    matchPoints = new MatchPoints({
      ageRange: Math.floor(Math.random() * 4) + 1,
      heightRange: Math.floor(Math.random() * 4) + 1,
      weightRange: Math.floor(Math.random() * 4) + 1,
      location: Math.floor(Math.random() * 4) + 1,
      interests: Math.floor(Math.random() * 4) + 1,
      hobbies: Math.floor(Math.random() * 4) + 1,
      education: Math.floor(Math.random() * 4) + 1,
      religion: Math.floor(Math.random() * 4) + 1,
      gender: Math.floor(Math.random() * 4) + 1,
      occupation: Math.floor(Math.random() * 4) + 1,
      lifestyle: Math.floor(Math.random() * 4) + 1,
      relation: Math.floor(Math.random() * 4) + 1,
    });
    await matchPoints.save();
    return res.json({ message: "retry", status: false });
  }

  let preferences = await Preference.findOne({ userId });
  if (!preferences) {
    preferences = new Preference({ userId });
    await preferences.save();
  }

  let currentLocation = user.location;
  let fetchQuery = {
    _id: { $ne: userId, $nin: [...user.rejected] },
    personalInfoSubmitted: true,
    professionalInfoSubmitted: true,
    purposeSubmitted: true,
    rejected: { $nin: [userId] },
  };

  if (filter) {
    switch (filter) {
      case "nearby":
        currentLocation = user.currentLocation;
        fetchQuery.location = user.location;
        break;
      case "qualification":
        fetchQuery["qualification.value"] = { $in: user.qualification.map(qual => qual.value) };
        break;
      case "interests":
        fetchQuery["interests.value"] = { $in: user.interests.map(intst => intst.value) };
        break;
      default:
        break;
    }
  }

  let matches = await User.find(
    fetchQuery,
    "id username age gender location hobbies interests smokingHabits drinkingHabits qualification profilePic images shortReel isOnline"
  )
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean()
    .exec();

  matches = await sortAndRankMatches(matches, preferences, matchPoints, currentLocation);

  const count = await User.countDocuments(fetchQuery);

  res.json({
    status: 200,
    success: true,
    message: "filtered matches",
    matches,
    totalMatches: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
});
