import axios from "axios";

async function requests(api, data = {}, method = 'POST', config = {}, onCancel = () => {}) {
    const baseURL = 'http://127.0.0.1:16001';
    const url = `${baseURL}/${api}`;

    const source = axios.CancelToken.source();

    const mergedConfig = {
        headers: {
            'Content-Type': 'application/json',
            ...config.headers 
        },
        timeout: config.timeout || 5000,
        cancelToken: source.token,
        ...config
    };

    try {
        const requestConfig = {
            method: method.toUpperCase(),
            url: url,
            ...mergedConfig
        };

        if (method.toUpperCase() === 'GET') {
            requestConfig.params = data;
        } else {
            requestConfig.data = data;
        }

        const response = await axios.request(requestConfig);
        return response.data;
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log('Request canceled', error.message);
            onCancel();
        } else {
            if (error.response) {
                throw error.response.data;
            } else {
                throw error;
            }
        }
    }
}

export default requests;