import { Document, model, Schema, Types } from "mongoose";

interface ISubscription extends Document {
    subscriber: Types.ObjectId;
    channel: Types.ObjectId;
}

const subscriptionSchema = new Schema<ISubscription>(
    {
        subscriber: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        channel: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

export const Subscription = model<ISubscription>(
    "Subscription",
    subscriptionSchema
);
