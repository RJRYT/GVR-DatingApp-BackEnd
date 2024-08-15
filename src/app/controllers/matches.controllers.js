const Schema = require("../models");
const User = Schema.user;
const Preferences = Schema.preferences;

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from matches" });
};

exports.matchAlgorithm = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query;

  try {
    // Get the user's matching preferences
    const preferences = await Preferences.findOne({ userId });
    if (!preferences) {
      return res.json({ status: 400, success: false, message: "No matching preferences found" });
    }

    let matchingQuery = {
      _id: { $ne: userId },
      age: {
        $gte: preferences.AgeRange.min,
        $lte: preferences.AgeRange.max,
      },
      location: preferences.Location,
      purpose: "shortTermRelationShip",
    };
    if (preferences.Interests.length) {
      matchingQuery["interests.value"] = { $in: preferences.Interests };
    }
    if (preferences.Hobbies.length) {
      matchingQuery["hobbies.value"] = { $in: preferences.Hobbies };
    }
    if (preferences.Education.length) {
      matchingQuery["qualification.value"] = { $in: preferences.Education };
    }
    if (preferences.Gender) {
      matchingQuery.gender = preferences.Gender;
    }
    if (preferences.Smoking) {
      matchingQuery.smokingHabits = preferences.Smoking;
    }
    if (preferences.Drinking) {
      matchingQuery.drinkingHabits = preferences.Drinking;
    }

    // Find users that match the preferences
    const matches = await User.find(
      matchingQuery,
      "id username age gender location hobbies interests smokingHabits drinkingHabits qualification profilePic shortReel"
    )
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total matching users count
    const count = await User.countDocuments(matchingQuery);

    res.json({
      status: 200,
      success: true,
      message: "Matches found",
      matches,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 500, success: false, message: "Server Error" });
  }
};

exports.modifyPreferences = async (req, res) => {
  const userId = req.user.id;
  const {
    AgeRange,
    Location,
    Interests,
    Hobbies,
    Education,
    Gender,
    Smoking,
    Drinking,
  } = req.body;

  if (!AgeRange || !AgeRange.min || !AgeRange.max || !Location) {
    return res.json({ status: 400, success: false, message: "AgeRange and Location are required." });
  }

  try {
    // Get the user's matching preferences
    let preferences = await Preferences.findOne({ userId });

    if (preferences) {
      // Update existing preferences
      preferences.AgeRange = AgeRange;
      preferences.Location = Location;
      preferences.Interests = Interests || [];
      preferences.Hobbies = Hobbies || [];
      preferences.Education = Education || [];
      preferences.Gender = Gender || "";
      preferences.Smoking = Smoking || "";
      preferences.Drinking = Drinking || "";

      await preferences.save();
    } else {
      // Add new preferences
      preferences = new Preferences({
        userId,
        AgeRange,
        Location,
        Interests,
        Hobbies,
        Education,
        Gender,
        Smoking,
        Drinking,
      });

      await preferences.save();
    }
    res.json({ status: 200, success: true, message: "Preferences saved successfully.", preferences });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 500, success: false, message: "Server Error" });
  }
};

exports.viewPreferences = async (req, res) => {
  const userId = req.user.id;

  try {
    // Get the user's matching preferences
    const preferences = await Preferences.findOne({ userId });
    if (!preferences) {
      return res.json({ status: 400, success: false, message: "No matching preferences found" });
    }
    res.json({ status: 200, success: true, preferences });
  } catch (err) {
    console.error(err);
    res.status(500).send({ status: 500, success: false, message: "Server Error" });
  }
};
