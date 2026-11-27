<?php
declare(strict_types=1);

namespace App\Controllers\Customer;

use App\Services\PasswordChangeService;
use App\Services\ProfileService;
use Request;
use Response;
use Session;

final class ProfileController
{
    public function __construct(
        private ProfileService $profiles,
        private PasswordChangeService $passwords
    ) {
    }

    public function update(Request $request, array $params = []): void
    {
        $result = $this->profiles->updateName(
            (int) Session::get('user_id'),
            'Customer',
            $request->input('ho_ten')
        );
        if ($result['status'] !== 200) {
            Response::error($result['message'], $result['status'], $result['errors'] ?? null);
            return;
        }

        Response::success($result['message'], ['user' => $result['user']]);
    }

    public function changePassword(Request $request, array $params = []): void
    {
        $result = $this->passwords->change(
            (int) Session::get('user_id'),
            'Customer',
            $request->all()
        );
        if ($result['status'] !== 200) {
            Response::error($result['message'], $result['status'], $result['errors'] ?? null);
            return;
        }

        Response::success($result['message']);
    }
}
