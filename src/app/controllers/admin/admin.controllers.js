const { Admin } = require("../../models");
const CatchAsync = require("../../util/catchAsync");
const Subscription = require("../../models/Admin/subscription.model");

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from admins" });
};

exports.fetchAdminDetails = CatchAsync(async (req, res) => {
  const adminId = req.admin.adminId;
  const admin = await Admin.findById(adminId).select("-password");
  res.json({
    status: 200,
    success: true,
    message: "Admin details",
    user: admin,
  });
});

exports.addSubscription = CatchAsync(async (req, res) => {
  try {
    const { name, price, duration, subscriptiontype, description } = req.body;
    const newSubscription = new Subscription({
      name,
      price,
      duration,
      subscriptiontype,
      image,
      description,
    });

    const savedSubscription = await newSubscription.save();
    return res.status(201).json({
      message: "Subscription added successfully",
      subscription: savedSubscription,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error adding subscription",
      error: error.message,
    });
  }
});
