const { Admin } = require("../../models");
const CatchAsync = require("../../util/catchAsync");
const bcrypt = require ("bcryptjs");

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from admins" });
};

exports.fetchAdminDetails = CatchAsync(async(req, res) => {
  const adminId = req.admin.adminId;
  const admin = await Admin.findById(adminId).select("-password");
  res.json({ status: 200, success: true, message: "Admin details", user:admin });
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
