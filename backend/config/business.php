<?php
declare(strict_types=1);

return [
  'store' => [
    'name' => 'MON SMOKEE',
    'address' => '(cập nhật) Đồng Hới, Quảng Bình',
    'phone' => '(cập nhật)',
    'lat' => null,
    'lng' => null,
    'open_time' => '07:00',
    'close_time' => '21:30',
  ],
  'otp' => [
    'length' => 6,
    'ttl_seconds' => 300,
    'max_wrong_attempts' => 5,
    'resend_cooldown_seconds' => 60,
    'max_sends_per_hour' => 5,
  ],
  'password' => ['min_length' => 8],
  'password_change' => ['max_fail' => 5, 'lock_minutes' => 15],
  'password_reset_ticket' => ['ttl_seconds' => 600],
  'login' => ['max_fail' => 5, 'lock_minutes' => 15],
  'shipping' => [
    'cod_min_order' => 50000,
    'free_ship_min_order' => 150000,
    'free_ship_max_km' => 2.5,
    'fee_default' => 15000,
    'max_service_km' => 6.0,
    'fee_manual_max' => 100000,
    'delivery_min_order' => 50000,
  ],
  'click_collect' => ['auto_cancel_hours' => 48],
  'promotion' => [
    'friday_percent' => 10,
    'friday_product_count' => 10,
    'near_expiry_days' => 10,
    'near_expiry_percent' => 50,
    'friday_iso_weekday' => 5,
  ],
  'stock' => ['low_stock_threshold_default' => 10],
  'cart' => ['max_qty_per_line' => 99],
  'service_area' => ['province' => 'Quảng Bình', 'district' => 'TP. Đồng Hới'],
];