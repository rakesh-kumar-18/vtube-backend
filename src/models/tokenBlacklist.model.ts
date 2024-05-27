import { Document, model, Schema } from "mongoose";

interface ITokenBlacklist extends Document {
    token: string;
    createdAt: Date;
}

const tokenBlacklistSchema = new Schema<ITokenBlacklist>({
    token: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        expires: "1d",
        default: Date.now,
    },
});

export const TokenBlacklist = model<ITokenBlacklist>(
    "TokenBlacklist",
    tokenBlacklistSchema
);
