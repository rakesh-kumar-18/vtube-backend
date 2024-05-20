import "dotenv/config";
import connectDB from "./db";
import app from "./app";

const port = process.env.PORT || 8000;

connectDB()
    .then(() => {
        app.on("error", (error) => {
            console.log("Server Error: ", error);
            throw error;
        });
        app.listen(port, () => {
            console.log(`Server listening on port ${port}`);
        });
    })
    .catch((err) => console.log("MONGODB connection error: ", err));
