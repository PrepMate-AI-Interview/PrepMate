using System;

namespace backend.Services.AI
{
    public class AiGatewayException : Exception
    {
        public int StatusCode { get; }
        public string UserFacingMessage { get; }

        public AiGatewayException(int statusCode, string userFacingMessage, string? internalDetail = null, Exception? innerException = null)
            : base(internalDetail ?? userFacingMessage, innerException)
        {
            StatusCode = statusCode;
            UserFacingMessage = userFacingMessage;
        }
    }
}
