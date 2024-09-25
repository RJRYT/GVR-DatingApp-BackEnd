const { Admin,User } = require("../../models");
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

exports.adminUserList = CatchAsync(async(req, res) => {
  const { page = 1, limit = 10 } = req.query; // Default to page 1 and limit of 10

  try {
    const users = await User.find({})
      .limit(limit * 1) // Convert limit to number and set limit
      .skip((page - 1) * limit) // Skip based on the page
      .exec();

    // Count total number of users for calculating total pages
    const count = await User.countDocuments();

    res.status(200).json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
});

exports.updateAdminProfile = CatchAsync( async (req, res) => {
  const adminId = req.admin.adminId;  
  const { firstName, lastName, email, phoneNumber, countryCode, nationality, designation, password } = req.body;

  try {
    
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    // Update the admin's profile fields
    admin.firstName = firstName || admin.firstName;
    admin.lastName = lastName || admin.lastName;
    admin.email = email || admin.email;
    admin.phoneNumber = phoneNumber || admin.phoneNumber;
    admin.countryCode = countryCode || admin.countryCode;
    admin.nationality = nationality || admin.nationality;
    admin.designation = designation || admin.designation;
    admin.password = password || admin.password;
    // Save the updated admin profile
    await admin.save();

    // Return a success response
    return res.status(200).json({ 
      success: true, 
      message: "Admin profile updated successfully.", 
      user: admin 
    });
  } catch (error) {
    console.error("Error while updating admin profile:", error);
    return res.status(500).json({ success: false, message: "Failed to update admin profile", error: error.message });
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
