/**
 * FTP Response Codes - RFC 959 Compliant
 */
export const FTP_CODES = {
  // 100 - 199 :: Positive Preliminary Replies
  RESTART_MARKER_REPLY: 110,
  SERVICE_READY_IN_MINUTES: 120,
  DATA_CONNECTION_OPEN_TRANSFER_STARTING: 125,
  FILE_STATUS_OK_OPENING_DATA_CONNECTION: 150,

  // 200 - 299 :: Positive Completion Replies
  COMMAND_OK: 200,
  COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS: 202,
  SYSTEM_STATUS: 211,
  DIRECTORY_STATUS: 212,
  FILE_STATUS: 213,
  HELP_MESSAGE: 214,
  SYSTEM_TYPE: 215,
  SERVICE_READY: 220,
  SERVICE_CLOSING: 221,
  DATA_CONNECTION_OPEN: 225,
  CLOSING_DATA_CONNECTION: 226,
  ENTERING_PASSIVE_MODE: 227,
  ENTERING_LONG_PASSIVE_MODE: 228,
  ENTERING_EXTENDED_PASSIVE_MODE: 229,
  USER_LOGGED_IN: 230,
  USER_LOGGED_IN_AUTHORIZED: 232,
  SECURITY_MECHANISM_OK: 234,
  SECURITY_DATA_OK: 235,
  FILE_ACTION_OK: 250,
  PATHNAME_CREATED: 257,

  // 300 - 399 :: Positive Intermediate Replies
  USER_NAME_OK_NEED_PASSWORD: 331,
  NEED_ACCOUNT_FOR_LOGIN: 332,
  SECURITY_MECHANISM_ACCEPTED: 334,
  USERNAME_OK_CHALLENGE: 336,
  FILE_ACTION_PENDING: 350,

  // 400 - 499 :: Transient Negative Completion Replies
  SERVICE_NOT_AVAILABLE: 421,
  CANT_OPEN_DATA_CONNECTION: 425,
  CONNECTION_CLOSED_TRANSFER_ABORTED: 426,
  INVALID_USERNAME_PASSWORD: 430,
  NEED_UNAVAILABLE_RESOURCE: 431,
  REQUESTED_HOST_UNAVAILABLE: 434,
  FILE_ACTION_NOT_TAKEN: 450,
  ACTION_ABORTED_LOCAL_ERROR: 451,
  ACTION_NOT_TAKEN_INSUFFICIENT_STORAGE: 452,

  // 500 - 599 :: Permanent Negative Completion Replies
  SYNTAX_ERROR_COMMAND_UNRECOGNIZED: 500,
  SYNTAX_ERROR_PARAMETERS: 501,
  COMMAND_NOT_IMPLEMENTED: 502,
  BAD_SEQUENCE_OF_COMMANDS: 503,
  COMMAND_NOT_IMPLEMENTED_FOR_PARAMETER: 504,
  NOT_LOGGED_IN: 530,
  NEED_ACCOUNT_FOR_STORING_FILES: 532,
  COMMAND_PROTECTION_DENIED: 533,
  REQUEST_DENIED_POLICY: 534,
  FAILED_SECURITY_CHECK: 535,
  DATA_PROTECTION_LEVEL_NOT_SUPPORTED: 536,
  COMMAND_PROTECTION_LEVEL_NOT_SUPPORTED: 537,
  FILE_UNAVAILABLE: 550,
  PAGE_TYPE_UNKNOWN: 551,
  EXCEEDED_STORAGE_ALLOCATION: 552,
  FILE_NAME_NOT_ALLOWED: 553,

  // 600 - 699 :: Protected Replies (RFC 2228)
  INTEGRITY_PROTECTED_REPLY: 631,
  CONFIDENTIALITY_INTEGRITY_PROTECTED_REPLY: 632,
  CONFIDENTIALITY_PROTECTED_REPLY: 633,
} as const;

export type FtpCode = (typeof FTP_CODES)[keyof typeof FTP_CODES];

const DEFAULT_MESSAGES = {
  // 100 - 199 :: Positive Preliminary Replies
  // The requested action is being initiated; expect another reply before proceeding with a new command.
  [FTP_CODES.RESTART_MARKER_REPLY]: 'Restart marker reply', // In this case, the text is exact and not left to the particular implementation; it must read: MARK yyyy = mmmm
  [FTP_CODES.SERVICE_READY_IN_MINUTES]: 'Service ready in %s minutes',
  [FTP_CODES.DATA_CONNECTION_OPEN_TRANSFER_STARTING]:
    'Data connection already open; transfer starting',
  [FTP_CODES.FILE_STATUS_OK_OPENING_DATA_CONNECTION]:
    'File status okay; about to open data connection',

  // 200 - 299 :: Positive Completion Replies
  // The requested action has been successfully completed. A new request may be initiated.
  [FTP_CODES.COMMAND_OK]: 'Command okay',
  [FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS]:
    'Command not implemented, superfluous at this site',
  [FTP_CODES.SYSTEM_STATUS]: 'System status, or system help reply',
  [FTP_CODES.DIRECTORY_STATUS]: 'Directory status',
  [FTP_CODES.FILE_STATUS]: 'File status',
  [FTP_CODES.HELP_MESSAGE]: 'Help message', // On how to use the server or the meaning of a particular non-standard command
  [FTP_CODES.SYSTEM_TYPE]: 'UNIX Type: L8', // NAME system type. Where NAME is an official system name from the Assigned Numbers document
  [FTP_CODES.SERVICE_READY]: 'Service ready for new user',
  [FTP_CODES.SERVICE_CLOSING]: 'Service closing control connection', // Logged out if appropriate
  [FTP_CODES.DATA_CONNECTION_OPEN]:
    'Data connection open; no transfer in progress',
  [FTP_CODES.CLOSING_DATA_CONNECTION]: 'Closing data connection', // Requested file action successful (for example, file transfer or file abort)
  [FTP_CODES.ENTERING_PASSIVE_MODE]: 'Entering Passive Mode', // (h1,h2,h3,h4,p1,p2)
  [FTP_CODES.ENTERING_LONG_PASSIVE_MODE]: 'Entering Long Passive Mode', // (long address, port)
  [FTP_CODES.ENTERING_EXTENDED_PASSIVE_MODE]: 'Entering Extended Passive Mode', // (|||port|)
  [FTP_CODES.USER_LOGGED_IN]: 'User logged in, proceed',
  [FTP_CODES.USER_LOGGED_IN_AUTHORIZED]:
    'User logged in, authorized by security data exchange',
  [FTP_CODES.SECURITY_MECHANISM_OK]:
    'Server accepts the security mechanism specified by the client', // no security data needs to be exchanged
  [FTP_CODES.SECURITY_DATA_OK]:
    'Server accepts the security data given by the client', // no further security data needs to be exchanged
  [FTP_CODES.FILE_ACTION_OK]: 'Requested file action okay, completed',
  [FTP_CODES.PATHNAME_CREATED]: "'%s' created",

  // 300 - 399 :: Positive Intermediate Replies
  // The command has been accepted, but the requested action is being held in abeyance, pending receipt of further information.
  [FTP_CODES.USER_NAME_OK_NEED_PASSWORD]: 'User name okay, need password',
  [FTP_CODES.NEED_ACCOUNT_FOR_LOGIN]: 'Need account for login',
  [FTP_CODES.SECURITY_MECHANISM_ACCEPTED]:
    'Server accepts the security mechanism specified by the client', // some security data needs to be exchanged
  [FTP_CODES.USERNAME_OK_CHALLENGE]:
    'Username okay, password okay. Challenge is "%s"',
  [FTP_CODES.FILE_ACTION_PENDING]:
    'Requested file action pending further information',

  // 400 - 499 :: Transient Negative Completion Replies
  // The command was not accepted and the requested action did not take place, but the error condition is temporary.
  [FTP_CODES.SERVICE_NOT_AVAILABLE]:
    'Service not available, closing control connection', // This may be a reply to any command if the service knows it must shut down
  [FTP_CODES.CANT_OPEN_DATA_CONNECTION]: "Can't open data connection",
  [FTP_CODES.CONNECTION_CLOSED_TRANSFER_ABORTED]:
    'Connection closed; transfer aborted',
  [FTP_CODES.INVALID_USERNAME_PASSWORD]: 'Invalid username or password',
  [FTP_CODES.NEED_UNAVAILABLE_RESOURCE]:
    'Need some unavailable resource to process security',
  [FTP_CODES.REQUESTED_HOST_UNAVAILABLE]: 'Requested host unavailable',
  [FTP_CODES.FILE_ACTION_NOT_TAKEN]: 'Requested file action not taken', // File unavailable (e.g., file busy)
  [FTP_CODES.ACTION_ABORTED_LOCAL_ERROR]:
    'Requested action aborted. Local error in processing',
  [FTP_CODES.ACTION_NOT_TAKEN_INSUFFICIENT_STORAGE]:
    'Requested action not taken. Insufficient storage space in system', // File unavailable (e.g., file busy)

  // 500 - 599 :: Permanent Negative Completion Replies
  // The command was not accepted and the requested action did not take place.
  [FTP_CODES.SYNTAX_ERROR_COMMAND_UNRECOGNIZED]:
    'Syntax error, command unrecognized', // This may include errors such as command line too long
  [FTP_CODES.SYNTAX_ERROR_PARAMETERS]:
    'Syntax error in parameters or arguments',
  [FTP_CODES.COMMAND_NOT_IMPLEMENTED]: 'Command not implemented',
  [FTP_CODES.BAD_SEQUENCE_OF_COMMANDS]: 'Bad sequence of commands',
  [FTP_CODES.COMMAND_NOT_IMPLEMENTED_FOR_PARAMETER]:
    'Command not implemented for that parameter',
  [FTP_CODES.NOT_LOGGED_IN]: 'Not logged in',
  [FTP_CODES.NEED_ACCOUNT_FOR_STORING_FILES]: 'Need account for storing files',
  [FTP_CODES.COMMAND_PROTECTION_DENIED]:
    'Command protection level denied for policy reasons',
  [FTP_CODES.REQUEST_DENIED_POLICY]: 'Request denied for policy reasons',
  [FTP_CODES.FAILED_SECURITY_CHECK]: 'Failed security check',
  [FTP_CODES.DATA_PROTECTION_LEVEL_NOT_SUPPORTED]:
    'Data protection level not supported by security mechanism',
  [FTP_CODES.COMMAND_PROTECTION_LEVEL_NOT_SUPPORTED]:
    'Command protection level not supported by security mechanism',
  [FTP_CODES.FILE_UNAVAILABLE]: 'Requested action not taken. File unavailable', // (e.g., file not found, no access)
  [FTP_CODES.PAGE_TYPE_UNKNOWN]: 'Requested action aborted. Page type unknown',
  [FTP_CODES.EXCEEDED_STORAGE_ALLOCATION]:
    'Requested file action aborted. Exceeded storage allocation', // (for current directory or dataset)
  [FTP_CODES.FILE_NAME_NOT_ALLOWED]:
    'Requested action not taken. File name not allowed',

  // 600 - 699 :: Protected Replies (RFC 2228)
  // Base64 encoded protected messages that serve as responses to secure commands
  [FTP_CODES.INTEGRITY_PROTECTED_REPLY]: 'Integrity protected reply',
  [FTP_CODES.CONFIDENTIALITY_INTEGRITY_PROTECTED_REPLY]:
    'Confidentiality and integrity protected reply',
  [FTP_CODES.CONFIDENTIALITY_PROTECTED_REPLY]:
    'Confidentiality protected reply',
};

export default DEFAULT_MESSAGES;
