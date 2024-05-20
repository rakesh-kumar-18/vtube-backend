import { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncHandler = (
    fn: (
        req: Request,
        res: Response,
        next: NextFunction
    ) => void | Promise<void>
) => RequestHandler;

const asyncHandler: AsyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
