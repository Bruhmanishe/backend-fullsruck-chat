import { db } from "../db.js";
import jwt from "jsonwebtoken";
import url from "url";
import { handleSendMessage } from "../index.js";

export const sendMessage = (req, res) => {
  if (req.body?.text.length < 1)
    return res.status(405).json("Text is required!");
  const message = req.body;
  const token = req.cookies?.access_token;
  jwt.verify(token, "jwtkey", (err, userInfo) => {
    if (err) return res.status(401).json("Invalid token!");
    if (userInfo.id !== parseInt(req.body?.userId))
      return res.status(401).json("Invalid token!");

    const q =
      "INSERT INTO messages(`text`, `userId`, `chatId`, `replyTo`, `date`) VALUES (?)";
    const queryArray = [
      message.text,
      message.userId,
      message.chatId,
      message.replyTo,
      new Date().toISOString().split("T")[0] +
        " " +
        new Date().toTimeString().split(" ")[0],
    ];
    db.query(q, [queryArray], (err, data) => {
      if (err)
        return res.status(405).json("Wrong user or chat"), console.log(err);

      const q = "SELECT * FROM messages WHERE id=?";
      db.query(q, [data.insertId], (err, data) => {
        if (err)
          return res.status(405).json("Wrong user or chat"), console.log(err);
        const message = data[0];
        const q = "SELECT * FROM chatUsers WHERE chatId=?";
        db.query(q, [message.chatId], (err, data) => {
          if (err)
            return res.status(405).json("Wrong user or chat"), console.log(err);
          data.forEach((user) => {
            handleSendMessage(
              ["getMessage", JSON.stringify(message)],
              user.chatUserId
            );
            if (user.chatUserId === userInfo.id) return;
            const q =
              "INSERT INTO notifications (`chatId`, `userId`, `messageId`) VALUES (?)";
            db.query(
              q,
              [[message.chatId, user.chatUserId, message.id]],
              (err, data) => {
                if (err)
                  return (
                    res.status(405).json("Wrong user or chat"), console.log(err)
                  );
                const q = "SELECT * FROM notifications WHERE userId=?";
                db.query(q, [user.chatUserId], (err, data) => {
                  if (err)
                    return res
                      .status(405)
                      .json("Unable to send notifications!");
                  handleSendMessage(
                    ["sendNotification", data],
                    user.chatUserId
                  );
                });
              }
            );
          });
          res.status(200).json("Message delivered!");
        });
      });
    });
  });
};

export const deleteMessage = (req, res) => {
  const messageId = url.parse(req.url, true).query?.id;
  if (!messageId) return res.status(405).json("Incorrect message Id");
  const token = req.cookies?.access_token;
  jwt.verify(token, "jwtkey", (err, userInfo) => {
    if (err) return res.status(401).json("Invalid token!");

    const q = "SELECT * FROM messages WHERE id=?";
    db.query(q, [messageId], (err, data) => {
      if (err) return res.status(401).json("Invalid messageId");
      if (data.length < 1) return res.status(401).json("Invalid messageId");
      const message = data[0];
      if (message.userId !== userInfo.id)
        return res.status(406).json("You cannot delete others messages!");
      const q = "DELETE FROM messages WHERE id=?";

      db.query(q, [messageId], (err, data) => {
        if (err) return res.status(401).json("Invalid messageId");

        const q = "SELECT * FROM chatUsers WHERE chatId=?";
        db.query(q, [message.chatId], (err, data) => {
          if (err) return res.status(401).json("Invalid messageId");
          data.forEach((user, index) => {
            handleSendMessage(
              ["updateMessages", JSON.stringify("")],
              user.chatUserId
            );
            if (index === data.length - 1)
              return res.status(200).json("message deleted successfully!");
          });
        });
      });
    });
  });
};

export const setReaction = (req, res) => {
  if (!req.body?.emoji) return res.status(405).json("Reaction is required!");
  const reactionData = [
    req.body.messageId,
    req.body.userId,
    req.body.emoji,
    req.body.chatId,
  ];
  const token = req.cookies?.access_token;
  jwt.verify(token, "jwtkey", (err, userInfo) => {
    if (err) return res.status(401).json("Invalid token!");
    if (userInfo.id !== parseInt(req.body?.userId))
      return res.status(401).json("Invalid token!");

    const q = "SELECT * FROM reactions WHERE userId=? AND messageId=?";
    db.query(q, [req.body.userId, req.body.messageId], (err, data) => {
      if (err) return res.status(405).json("INCORRECT data"), console.log(err);
      let q = "";
      let alreadyExistingRec = null;
      console.log(data);
      if (data.length > 0) {
        q =
          "UPDATE reactions SET messageId=?, userId=?, emoji=?, chatId=? WHERE id=?";
        alreadyExistingRec = data;
      } else {
        q =
          "INSERT INTO reactions(`messageId`, `userId`, `emoji`, `chatId`) VALUES(?)";
      }
      if (data.length > 0 && req.body.emoji === data[0]?.emoji)
        q = "DELETE FROM reactions WHERE id=?";

      db.query(
        q,
        data.length > 0 && req.body.emoji === data[0]?.emoji
          ? [data[0].id]
          : data.length > 0
          ? [...reactionData, data[0].id]
          : [reactionData],
        (err, data) => {
          if (err)
            return res.status(405).json("INCORRECT data"), console.log(err);
          const q = "SELECT * FROM chatUsers WHERE chatId=?";
          const insertId = data.insertId;
          db.query(q, [req.body.chatId], (err, data) => {
            if (err) return res.status(405).json("INCORRECT data");
            data.forEach((user) => {
              handleSendMessage(
                ["updateReactions", JSON.stringify("")],
                user.chatUserId
              );
              if (user.chatUserId === userInfo.id) return;
              const q =
                "INSERT INTO notifications (`chatId`, `userId`, `messageId`) VALUES (?)";
              db.query(
                q,
                [[req.body.chatId, user.chatUserId, req.body.messageId]],
                (err, data) => {
                  if (err)
                    return (
                      res.status(405).json("Wrong user or chat"),
                      console.log(err)
                    );
                  const q = "SELECT * FROM notifications WHERE userId=?";
                  db.query(q, [user.chatUserId], (err, data) => {
                    if (err)
                      return res
                        .status(405)
                        .json("Unable to send notifications!");
                    if (
                      alreadyExistingRec?.length > 0 &&
                      req.body.emoji === alreadyExistingRec[0]?.emoji
                    )
                      return res
                        .status(200)
                        .json("Added reaction successfully!");
                    handleSendMessage(
                      ["sendNotification", data],
                      user.chatUserId
                    );
                    return res.status(200).json("Added reaction successfully!");
                  });
                }
              );
            });
          });
        }
      );
    });
  });
};

export const changeMessage = (req, res) => {
  const updatedMessageData = req.body;
  if (!updatedMessageData?.text || !updatedMessageData?.id)
    return res.status(405).json("Incorrect message object");
  const token = req.cookies?.access_token;
  jwt.verify(token, "jwtkey", (err, userInfo) => {
    if (err) return res.status(401).json("Invalid token!");

    const q = "SELECT * FROM messages WHERE id=?";
    db.query(q, [updatedMessageData.id], (err, data) => {
      if (err) return res.status(401).json("Invalid messageId");
      if (data.length < 1) return res.status(401).json("Invalid messageId");
      const message = data[0];
      if (message.userId !== userInfo.id)
        return res.status(406).json("You cannot delete others messages!");
      const q = "UPDATE messages SET `text`=?, `isChanged`=? WHERE id=?";
      db.query(
        q,
        [updatedMessageData.text, 1, updatedMessageData.id],
        (err, data) => {
          if (err)
            return res.status(401).json("Invalid messageId"), console.log(err);

          const q = "SELECT * FROM chatUsers WHERE chatId=?";
          db.query(q, [message.chatId], (err, data) => {
            if (err) return res.status(401).json("Invalid messageId");
            data.forEach((user, index) => {
              handleSendMessage(
                ["updateMessages", JSON.stringify("")],
                user.chatUserId
              );
              if (index === data.length - 1)
                return res.status(200).json("message changed successfully!");
            });
          });
        }
      );
    });
  });
};
