import mysql2 from "mysql2";

export const db = mysql2.createConnection({
  database: "bobwbrw0buuw7s5ryy14",
  user: "uvptahrgka3m8b4v",
  password: "TCQ8RHw2ejgqAkj1Y35e",
  host: "bobwbrw0buuw7s5ryy14-mysql.services.clever-cloud.com",
  port: 3306,
});

setInterval(() => {
  const Pooling = () => {
    const q = "SELECT * FROM users";
    db.query(q, [], (err, data) => {
      if (err) return Pooling();
      return console.log("Connection served!");
    });
  };

  Pooling();
}, Math.pow(10, 4.5));
