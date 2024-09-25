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
  console.log(req.body) 
  try {  
    const { name, price, duration, subscriptiontype, description } = req.body;
    const newSubscription = new Subscription({
      name,
      price,
      duration,
      subscriptiontype,
      description,
    });
    await newSubscription.save();
    return res.status(201).json({
      message: "Subscription added successfully",
      subscription: newSubscription,
    });
    
  } catch (error) {
    return res.status(500).json({
      message: "Error adding subscription",
      error: error.message,
    });
  }
});

exports.getSubscription =CatchAsync(async(req,res) => {
  try {
    const subscriptions = await Subscription.find()
    return res.status(200).json(subscriptions)
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching subscriptions",
      error: error.message,
    });
  }
})

exports.deleteSubscription=CatchAsync(async (req,res) =>{
  try {
    const subscriptionId = req.params.id;
    await Subscription.findByIdAndDelete(subscriptionId);
    return res.status(200).json({ success: true, message: "Subscription deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error deleting subscription" });
  }
})
