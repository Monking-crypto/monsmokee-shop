<?php
declare(strict_types=1);

/**
 * Hằng dùng chung cho các controller; controller nghiệp vụ kế thừa lớp này.
 */
abstract class BaseController
{
    protected Request $request;

    public function __construct(Request $request)
    {
        $this->request = $request;
    }
}
