require("dotenv").config({ path: "../src/.env" });
const { faker } = require("@faker-js/faker");
const fs = require("fs");
const path = require("path");
const connectToDatabase = require("../src/app/config/db.config");
const { User } = require("../src/app/models");

const {
  hobbies,
  interests,
  smokingHabits,
  drinkingHabits,
  qualifications,
  expertLevel,
  locations,
} = require("./Data");

const deleteFakeUsers = async () => {
  try {
    const res = await User.deleteMany({ fake: true });
    console.log("Deleted all fake users. Response: ", res);
  } catch (err) {
    console.error("Error deleting fake users:", err);
  }
};

const generateRandomUser = async () => {
  const _randomUser = {
    firstName: faker.person.firstName(),
    middleName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    username: faker.internet.userName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    googleId: faker.string.uuid(),
    phoneNumber: faker.phone.number(),
    date: faker.date.past(),
    numberVerified: faker.helpers.arrayElement([false, true]),
    emailVerified: faker.helpers.arrayElement([false, true]),
    personalInfoSubmitted: faker.helpers.arrayElement([true, true]),
    professionalInfoSubmitted: faker.helpers.arrayElement([true, true]),
    purposeSubmitted: faker.helpers.arrayElement([true, true]),
    age: faker.number.int({ min: 20, max: 40 }),
    dateOfBirth: faker.date.between({
      from: "1983-01-01T00:00:00.000Z",
      to: "2003-12-31T00:00:00.000Z",
    }),
    gender: faker.person.sexType(),
    location: faker.helpers.arrayElement(locations.map((loc) => loc.value)),
    hobbies: faker.helpers.arrayElements(hobbies, 3),
    interests: faker.helpers.arrayElements(interests, 3),
    smokingHabits: faker.helpers.arrayElement(
      smokingHabits.map((smk) => smk.value)
    ),
    drinkingHabits: faker.helpers.arrayElement(
      drinkingHabits.map((drnk) => drnk.value)
    ),
    qualification: faker.helpers.arrayElements(qualifications, 2),
    profilePic: {
      url: faker.image.avatar(),
      uploadedAt: faker.date.past(),
    },
    images: [
      {
        url: faker.image.avatar(),
        uploadedAt: faker.date.past(),
      },
    ],
    shortReel: {
      url: "https://www.example.com/shortreel.mp4",
      uploadedAt: faker.date.past(),
    },
    professionType: faker.helpers.arrayElement([
      "Employee",
      "Employer",
      "Jobseeker",
    ]),
    companyName: faker.company.name(),
    designation: faker.person.jobTitle(),
    jobTitle: faker.person.jobTitle(),
    jobLocation: faker.helpers.arrayElement(locations.map((loc) => loc.value)),
    expertiseLevel: faker.helpers.arrayElement(
      expertLevel.map((exp) => exp.value)
    ),
    purpose: faker.helpers.arrayElement([
      "longTermRelationShip",
      "shortTermRelationShip",
    ]),
    fake: true,
  };
  const _user = new User(_randomUser);
  await _user.save();
  _randomUser._id = _user._id;
  return _randomUser;
};

const generateUsers = async (numUsers) => {
  const users = [];
  for (let i = 0; i < numUsers; i++) {
    const user = await generateRandomUser();
    users.push(user);
  }
  return users;
};

const run = async () => {
  console.log("[Script]: Running...");
  await connectToDatabase();
  await deleteFakeUsers();
  try {
    const users = await generateUsers(50);

    fs.writeFileSync(
      path.join(__dirname, "users.json"),
      JSON.stringify(users, null, 2)
    );
    console.log("Fake user data generated and saved to users.json");
  } catch (err) {
    console.error("Error generating user data:", err);
  } finally {
    console.log("Database connection closed.");
    process.exit();
  }
};

run();
