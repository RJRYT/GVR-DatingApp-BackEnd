
module.exports.sortAndRankMatches = async (matchArray, preferences, adminPoints, userLocation) => {
  const matchesWithPercentage = await Promise.all(
    matchArray.map(async (match) => {
      const matchPercentage = await this.calculateMatchPercentage(match, preferences, adminPoints);
      const distanceFromUser = await this.getDistanceFromLatLonInKm(userLocation.latitude, userLocation.longitude, match.location.latitude, match.location.longitude);
      return { ...match, matchPercentage: matchPercentage.toFixed(2), distance: distanceFromUser.toFixed(2) };
    })
  );

  // Sort matches based on match percentage
  matchesWithPercentage.sort((a, b) => b.matchPercentage - a.matchPercentage);

  return matchesWithPercentage;
};

module.exports.calculateTotalPossiblePoints = (adminPoints) => {
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

module.exports.calculateMatchPercentage = async (match, preferences, adminPoints) => {
  let totalPoints = 0;
  let possiblePoints = this.calculateTotalPossiblePoints(adminPoints);

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
module.exports.getDistanceFromLatLonInKm = async (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = this.deg2rad(lat2 - lat1);
  const dLon = this.deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
};

module.exports.deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};