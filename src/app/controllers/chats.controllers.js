const { User, ChatRequests, PrivateChat, GroupChat, PrivateMessages } = require("../models");
const CatchAsync = require("../util/catchAsync");

exports.test = (req, res) => {
  res.json({ status: 200, success: true, message: "hello world from chats" });
};

exports.createGroupChat = CatchAsync(async (req, res) => {
  const { name, description } = req.body;
  const groupChat = new GroupChat({ name, description, admin: req.user.id, members: [req.user.id] });
  await groupChat.save();
  res.json({ status: 200, success: true, message: "Group created", group: groupChat });
});

exports.inviteToGroupChat = CatchAsync(async (req, res) => {
  const { userId } = req.body;
  const groupChat = await GroupChat.findById(req.params.groupId);

  if (!groupChat) return res.json({ status: 404, success: false, message: 'Group chat not found' });
  if (groupChat.admin.toString() !== req.user.id) return res.json({ status: 403, success: false, message: 'Unauthorized' });

  groupChat.invitations.push(userId);
  await groupChat.save();

  const invitee = await User.findById(userId);

  // Add a new notification to the invitee's notifications array
  const notification = {
    type: 'groupInvite',
    message: `You have been invited to join group ${groupId} by ${req.user.username}`,
    from: userId,
  };
  invitee.notifications.push(notification);
  await invitee.save();

  res.json({ status: 200, success: true, message: "Invite sended successfully" });
});

exports.respondToGroupInvite = CatchAsync(async (req, res) => {
  const { status } = req.body;  // 'accepted' or 'declined'
  const groupChat = await GroupChat.findById(req.params.groupId);

  if (!groupChat) return res.json({ status: 404, success: false, message: 'Group chat not found' });

  const invitationIndex = groupChat.invitations.indexOf(req.user.id);
  if (invitationIndex === -1) return res.json({ status: 400, success: false, message: 'No invitation found' });

  if (status === 'accepted') {
    groupChat.members.push(req.user.id);
  }
  groupChat.invitations.splice(invitationIndex, 1);
  await groupChat.save();

  const admin = await User.findById(groupChat.admin);

  const notification = {
    type: `${status === 'accepted' ? "inviteAccepted" : "inviteDeclined"}`,
    message: `${req.user.username} ${status} your invitation to group ${groupChat.name}`,
    from: req.user.id,
  };
  admin.notifications.push(notification);
  await admin.save();

  res.json({ status: 200, success: true, message: `Group invitation ${status}` });
});

exports.leaveFromGroup = CatchAsync(async (req, res) => {
  const groupChat = await GroupChat.findById(req.params.groupId);

  if (!groupChat) return res.json({ status: 404, success: false, message: 'Group chat not found' });

  const memberIndex = groupChat.members.indexOf(req.user.id);
  if (memberIndex === -1) return res.json({ status: 400, success: false, message: 'You are not a member of this group' });

  groupChat.members.splice(memberIndex, 1);
  if (groupChat.members.length === 0) {
    await groupChat.remove();  // Delete group if no members are left
  } else {
    await groupChat.save();
  }

  const admin = await User.findById(groupChat.admin);

  const notification = {
    type: "groupLeave",
    message: `${req.user.username} just leaved from your group ${groupChat.name}`,
    from: req.user.id,
  };
  admin.notifications.push(notification);
  await admin.save();

  res.json({ status: 200, success: true, message: "You leaved from this group" });
});

exports.fetchPrivateMessages = CatchAsync(async (req, res) => {
  const chat = await PrivateChat.findById(req.params.chatId)
    .populate("messages")
    .populate("participants", "username profilePic isOnline lastActive");
  res.json({ status: 200, success: true, message: "Your chats", chats: chat.messages, users: chat.participants });
});

exports.fetchGroupMessages = CatchAsync(async (req, res) => {
  const chat = await GroupChat.findById(req.params.chatId).populate('messages');
  res.json({ status: 200, success: true, message: "Your chats", chats: chat.messages });
});

exports.fetchChats = CatchAsync(async (req, res) => {
  const userId = req.user.id;

  const chats = await PrivateChat.find({ participants: userId })
    .populate('participants', 'username profilePic');

  const formattedChats = await Promise.all(chats.map(async chat => {
    const otherParticipant = chat.participants.find(p => p._id.toString() !== userId.toString());

    const lastMessage = await PrivateMessages.findOne({ chatRoom: chat._id })
      .sort({ timestamp: -1 })
      .lean();

    return {
      chatId: chat._id,
      user: {
        _id: otherParticipant._id,
        username: otherParticipant.username,
        profilePic: otherParticipant.profilePic,
      },
      lastMessage: {
        text: lastMessage ? lastMessage.content : "No messages yet",
        read: lastMessage ? lastMessage.read : true,
        timestamp: lastMessage ? lastMessage.createdAt : null,
      },
      isNew: Boolean(!lastMessage),
    };
  }));

  res.json({ status: 200, success: true, message: "Your chats list", chats: formattedChats });
})