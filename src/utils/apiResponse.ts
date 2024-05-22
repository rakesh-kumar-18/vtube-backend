class ApiResponse {
    statusCode: number;
    data: string;
    message: string;
    success: boolean;

    constructor(
        statusCode: number,
        data: string,
        message = "Success"
    ) {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}

export default ApiResponse;
