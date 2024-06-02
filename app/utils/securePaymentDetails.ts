import crypto from 'crypto';

interface Params {
    [key: string]: string;
}

export function generateSignedURL(baseURL: string | URL, params: Params, secretKey: string) {
    const url = new URL(baseURL);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const signature = crypto.createHmac('sha256', secretKey)
                            .update(url.search)
                            .digest('hex');

    url.searchParams.append('signature', signature);
    return url.href;
}
