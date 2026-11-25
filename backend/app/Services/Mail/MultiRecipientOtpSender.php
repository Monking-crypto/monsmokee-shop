<?php
declare(strict_types=1);

namespace App\Services\Mail;

use Exception;
use RuntimeException;

final class MultiRecipientOtpSender implements OtpSenderInterface
{
    public function __construct(
        private OtpSenderInterface $sender,
        private array $additionalRecipients
    ) {
    }

    public function send(string $email, string $otp, string $purpose): void
    {
        $recipients = array_values(array_unique([
            strtolower(trim($email)),
            ...array_map(
                static fn(string $recipient): string => strtolower(trim($recipient)),
                $this->additionalRecipients
            ),
        ]));
        $sent = false;
        foreach ($recipients as $recipient) {
            try {
                $this->sender->send($recipient, $otp, $purpose);
                $sent = true;
            } catch (Exception) {
                continue;
            }
        }

        if (!$sent) {
            throw new RuntimeException('OTP_SEND_FAILED');
        }
    }
}
