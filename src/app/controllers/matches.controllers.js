const { User, Preference, MatchPoints } = require("../models");
const CatchAsync = require("../util/catchAsync");

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
    ["location.name"]: { $in: preferences.Location.map(loc => loc.value) },
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
    matchingQuery.gender = preferences.Gender;
  }

  // Find users that match the preferences
  let matches = await User.find(
    matchingQuery,
    "id username age gender location hobbies interests smokingHabits drinkingHabits qualification profilePic images shortReel"
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
  if (!AgeRange || !AgeRange.min || !AgeRange.max || !Location.length) {
    return res.json({ status: 400, success: false, message: "AgeRange and Location are required." });
  }

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
    "id username age gender location hobbies interests smokingHabits drinkingHabits qualification profilePic images shortReel"
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

// Utility function
const sortAndRankMatches = async (matchArray, preferences, adminPoints, userLocation) => {
  const matchesWithPercentage = await Promise.all(
    matchArray.map(async (match) => {
      const matchPercentage = await calculateMatchPercentage(match, preferences, adminPoints);
      const distanceFromUser = await getDistanceFromLatLonInKm(userLocation.latitude, userLocation.longitude, match.latitude, match.longitude);
      return { ...match, matchPercentage: matchPercentage.toFixed(2), distance: distanceFromUser.toFixed(2) };
    })
  );

  // Sort matches based on match percentage
  matchesWithPercentage.sort((a, b) => b.matchPercentage - a.matchPercentage);

  return matchesWithPercentage;
};

const calculateTotalPossiblePoints = (adminPoints) => {
  return (
    adminPoints.location +
    adminPoints.ageRange +
    adminPoints.interests +
    adminPoints.hobbies +
    adminPoints.education +
    adminPoints.heightRange +
    adminPoints.weightRange +
    adminPoints.religion +
    adminPoints.gender +
    adminPoints.occupation +
    adminPoints.lifestyle +
    adminPoints.relation
  );
};

const calculateMatchPercentage = async (match, preferences, adminPoints) => {
  let totalPoints = 0;
  let possiblePoints = calculateTotalPossiblePoints(adminPoints);

  // Age Range
  if (preferences.AgeRange && match.age) {
    if (
      match.age >= preferences.AgeRange.min &&
      match.age <= preferences.AgeRange.max
    ) {
      totalPoints += adminPoints.ageRange;
    }
  }

  // Height Range
  if (preferences.HeightRange && match.height) {
    if (
      match.height >= preferences.HeightRange.min &&
      match.height <= preferences.HeightRange.max
    ) {
      totalPoints += adminPoints.heightRange;
    }
  }

  // Weight Range
  if (preferences.WeightRange && match.weight) {
    if (
      match.weight >= preferences.WeightRange.min &&
      match.weight <= preferences.WeightRange.max
    ) {
      totalPoints += adminPoints.weightRange;
    }
  }

  // Location
  if (preferences.Location.length > 0 && match.location) {
    if (preferences.Location.some((loc) => loc.value === match.location)) {
      totalPoints += adminPoints.location;
    }
  }

  // Interests
  if (preferences.Interests.length > 0 && match.interests) {
    const matchInterests = match.interests.map((interest) => interest.value);
    const commonInterests = preferences.Interests.filter((pref) =>
      matchInterests.includes(pref.value)
    );
    if (commonInterests.length > 0) {
      totalPoints +=
        (adminPoints.interests * commonInterests.length) /
        preferences.Interests.length;
    }
  }

  // Hobbies
  if (preferences.Hobbies.length > 0 && match.hobbies) {
    const matchHobbies = match.hobbies.map((hobby) => hobby.value);
    const commonHobbies = preferences.Hobbies.filter((pref) =>
      matchHobbies.includes(pref.value)
    );
    if (commonHobbies.length > 0) {
      totalPoints +=
        (adminPoints.hobbies * commonHobbies.length) /
        preferences.Hobbies.length;
    }
  }

  // Education
  if (preferences.Education.length > 0 && match.qualification) {
    const matchEducation = match.qualification.map((edu) => edu.value);
    const commonEducation = preferences.Education.filter((pref) =>
      matchEducation.includes(pref.value)
    );
    if (commonEducation.length > 0) {
      totalPoints +=
        (adminPoints.education * commonEducation.length) /
        preferences.Education.length;
    }
  }

  // Religion
  if (preferences.Religion && match.religion) {
    if (preferences.Religion.value === match.religion) {
      totalPoints += adminPoints.religion;
    }
  }

  // Gender
  if (preferences.Gender && match.gender) {
    if (preferences.Gender.value === match.gender) {
      totalPoints += adminPoints.gender;
    }
  }

  // Occupation
  if (preferences.Occupation && match.occupation) {
    if (preferences.Occupation.value === match.occupation) {
      totalPoints += adminPoints.occupation;
    }
  }

  // LifeStyle
  if (preferences.LifeStyle.length > 0 && match.lifeStyle) {
    const matchLifeStyle = match.lifeStyle.map((life) => life.value);
    const commonLifeStyle = preferences.LifeStyle.filter((pref) =>
      matchLifeStyle.includes(pref.value)
    );
    if (commonLifeStyle.length > 0) {
      totalPoints +=
        (adminPoints.lifestyle * commonLifeStyle.length) /
        preferences.LifeStyle.length;
    }
  }

  // Relation
  if (preferences.Relation && match.relation) {
    if (preferences.Relation.value === match.relation) {
      totalPoints += adminPoints.relation;
    }
  }

  // Calculate percentage
  const matchPercentage = (totalPoints / possiblePoints) * 100;

  return matchPercentage;
};

// Function to calculate the distance between two lat/lon pairs
const getDistanceFromLatLonInKm = async (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};