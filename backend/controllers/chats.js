import { db } from "../db.js";
import jwt from "jsonwebtoken";
import url from "url";
import { handleSendMessage } from "../index.js";

export const createChat = (req, res) => {
  if (!req.cookies?.access_token) return res.status(401).json("Please login!");
  const token = req.cookies.access_token;
  jwt.verify(token, "jwtkey", (err, userInfo) => {
    if (err) return res.status(401).json("Invalid token!");
    const users = url.parse(req.url, true).query;
    // console.log(userInfo.id, users.fromId);
    if (userInfo.id != users.fromId)
      return res.status(401).json("Incorrect token!");
    const q = "SELECT * FROM chatUsers WHERE `chatUserId`=? OR `chatUserId`=?";
    if (users.fromId === users.toId)
      return res.status(409).json("You can't message to youself!");
    db.query(q, [users.fromId, users.toId], (err, data) => {
      if (err)
        return (
          res.status(403).json("Server connection problem!"), console.log(err)
        );
      if (data.length > 2) return res.status(401).json("chat already exists!");
      const q = "INSERT INTO chats (`chatname`) VALUES (?)";
      db.query(q, [["chat"]], (err, data) => {
        if (err)
          return (
            res.status(403).json("Server connection problem!"), console.log(err)
          );
        const chatId = data.insertId;
        Object.keys(users).forEach((key) => {
          const q =
            "INSERT INTO `chatUsers`(`chatUserId`, `chatId`) VALUES (?)";
          db.query(q, [[parseInt(users[key]), chatId]], (err, data) => {
            if (err) return res.status(405).json("Server connection problem!");
            const q = "SELECT * FROM chatUsers WHERE chatUserId=?";
            db.query(q, [parseInt(users[key])], (err, data) => {
              if (err) return console.log(err);
              if (data.length < 1) return;
              const q =
                "INSERT INTO notifications (`chatId`, `userId`) VALUES (?)";
              db.query(q, [[chatId, parseInt(users[key])]], (err, data) => {
                if (err)
                  return res.status(405).json("Unable to send notifications!");
                const q = "SELECT * FROM notifications WHERE userId=?";
                db.query(q, [parseInt(users[key])], (err, data) => {
                  if (err)
                    return res
                      .status(405)
                      .json("Unable to send notifications!");
                  handleSendMessage(
                    ["sendNotification", data],
                    parseInt(users[key])
                  );
                });
              });
            });
          });
        });
        return res.status(200).json("Chat created successfully!");
      });
    });
  });
};

export const getChats = (req, res) => {
  const reqUserId = url.parse(req.url, true).query.userId;

  if (!req.cookies?.access_token) return res.status(401).json("Unauthorized");
  const token = req.cookies.access_token;
  jwt.verify(token, "jwtkey", (err, userInfo) => {
    if (err) return res.status(401).json("Invalid token");
    if (reqUserId != userInfo.id)
      return res.status(401).json("Incorrect token");
    const q = "SELECT * FROM chatUsers WHERE chatUserid=?";
    db.query(q, [userInfo.id], (err, data) => {
      if (err) return res.status(403).json("Server error!"), console.log(err);
      if (data.length < 1) return res.status(404).json("No chats found");
      const chatIds = [...data].map((chatU) => {
        return chatU.chatId;
      });
      if (err) return res.status(403).json("Server error!"), console.log(err);
      const q =
        "SELECT * FROM chatUsers WHERE chatId IN (?) AND chatUserId != ?";
      db.query(q, [chatIds, userInfo.id], (err, data) => {
        if (err) return res.status(403).json("Server error!"), console.log(err);
        const usersIds = [...data].map((chatUser) => {
          return chatUser.chatUserId;
        });
        const chatUsersData = [...data];
        const q = "SELECT * FROM users WHERE id IN (?)";
        db.query(q, [usersIds], (err, data) => {
          if (err)
            return res.status(403).json("Server error!"), console.log(err);
          const filteredUsersData = [...data].map((user) => {
            const { password, ...other } = user;
            return other;
          });
          chatUsersData.forEach((chat, index) => {
            const q =
              "SELECT * FROM messages WHERE chatId=? ORDER BY id DESC LIMIT 1;";
            db.query(q, [chat.chatId], (err, data) => {
              if (err) res.status(405).json("Unable to access data");
              filteredUsersData.forEach((user, index) => {
                if (chat.chatUserId === user.id)
                  return (
                    (user.chatId = chat.chatId),
                    (user.lastMessage = data[0] || null)
                  );
              });
              if (index === chatUsersData.length - 1)
                return res.status(200).json(filteredUsersData);
            });
          });
        });
      });
    });
  });
};

export const getChat = (req, res) => {
  const reqData = url.parse(req.url, true).query;
  const token = req.cookies?.access_token;
  jwt.verify(token, "jwtkey", (err, userInfo) => {
    if (err) return res.status(401).json("Invalid token!");
    if (userInfo.id !== parseInt(reqData.userId))
      return res.status(401).json("Invalid token!");

    const q =
      "SELECT * FROM chatUsers WHERE `chatUserId` != ? AND `chatId` = ?";
    db.query(
      q,
      [parseInt(reqData.userId), parseInt(reqData.chatId)],
      (err, data) => {
        if (err) return res.status(406).json("Wrong user or chat!");
        const q = "SELECT * FROM users WHERE id=?";

        db.query(q, [data[0].chatUserId], (err, data) => {
          if (err)
            return (
              res.status(406).json("Wrong user or chat!"), console.log(err)
            );
          const { password, ...filteredUserData } = data[0];
          const q = "SELECT * FROM messages WHERE chatId = ?";

          db.query(q, [parseInt(reqData.chatId)], (err, data) => {
            if (err)
              return (
                res.status(406).json("Wrong user or chat!"), console.log(err)
              );
            const messages = data;
            const q = "SELECT * FROM reactions WHERE chatId=?";
            db.query(q, [parseInt(reqData.chatId)], (err, data) => {
              if (err)
                return (
                  res.status(406).json("Wrong user or chat!"), console.log(err)
                );
              messages.forEach((message, index) => {
                message.reactions = [];
                data.forEach((reaction) => {
                  if (message.id === reaction.messageId)
                    message.reactions.push(reaction);
                });
              });
              const chatData = {
                user: filteredUserData,
                messages,
              };
              res.status(200).json(chatData);
            });
          });
        });
      }
    );
  });
};

export const markReadNotifications = (req, res) => {
  if (!req.cookies?.access_token) return res.status(401).json("Unauthorized");
  const token = req.cookies.access_token;
  jwt.verify(token, "jwtkey", (err, userInfo) => {
    console.log(userInfo);
    if (req.body?.userId !== userInfo.id)
      return res.status(401).json("Invalid token!");
    if (req.body?.notifications.length < 1)
      return console.log("No notifications!");
    const notificationIds = req.body.notifications.map((notification) => {
      return notification.id;
    });
    const q = "UPDATE notifications SET IsRead = ? WHERE id IN(?)";

    db.query(q, [1, notificationIds], (err, data) => {
      if (err)
        return (
          res.status(405).json("Unable to update notifications!"),
          console.log(err)
        );
      const q = "SELECT * FROM notifications WHERE userId=?";
      db.query(q, [userInfo.id], (err, data) => {
        if (err) return res.status(405).json("Unable to send notifications!");
        handleSendMessage(["sendNotification", data], userInfo.id);
      });
    });
  });
};
