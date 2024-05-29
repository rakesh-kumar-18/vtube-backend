import { Document, model, Schema, Types } from "mongoose";
import jwt, { Secret } from "jsonwebtoken";
import { compare, hash } from "bcrypt";

export interface IUser extends Document {
    username: string;
    email: string;
    fullName: string;
    avatar: {
        url: string;
        public_id: string;
    };
    coverImage: {
        url: string;
        public_id: string;
    };
    password: string;
    refreshToken: string | null;
    watchHistory: Types.ObjectId[];
    isValidPassword(password: string): Promise<boolean>;
    generateAccessToken(): string;
    generateRefreshToken(): string;
}

const userSchema = new Schema<IUser>(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        avatar: {
            url: {
                type: String,
                required: true,
            },
            public_id: {
                type: String,
                required: true,
            },
        },
        coverImage: {
            url: {
                type: String,
            },
            public_id: {
                type: String,
            },
        },
        password: {
            type: String,
            required: [true, "Password is required"],
        },
        refreshToken: {
            type: String,
            default: null,
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video",
            },
        ],
    },
    { timestamps: true }
);

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await hash(this.password, 12);
    next();
});

userSchema.methods.isValidPassword = async function (password: string) {
    return await compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            username: this.username,
            email: this.email,
            fullName: this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET as Secret,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET as Secret,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
};

export const User = model<IUser>("User", userSchema);
