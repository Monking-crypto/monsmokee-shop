<?php
declare(strict_types=1);

namespace App\Services\Mail;

interface OtpSenderInterface
{
    public function send(string $email, string $otp, string $purpose): void;
}
